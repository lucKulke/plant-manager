#pragma once

#include "esphome/core/component.h"
#include "esphome/components/sensor/sensor.h"
#include "esphome/components/i2c/i2c.h"

namespace esphome {
namespace stemma_soil_sensor {

static const char *const TAG = "stemma_soil_sensor";

#define SEESAW_HW_ID_CODE 0x36 ///< seesaw HW ID code for soil sensor

/** Module Base Addresses
 *  The module base addresses for different seesaw modules.
 */
enum {
    SEESAW_STATUS_BASE = 0x00,
    SEESAW_TOUCH_BASE = 0x0F,
};

/** status module function address registers
 */
enum {
    SEESAW_STATUS_HW_ID = 0x01,
    SEESAW_STATUS_VERSION = 0x02,
    SEESAW_STATUS_OPTIONS = 0x03,
    SEESAW_STATUS_TEMP = 0x04,
    SEESAW_STATUS_SWRST = 0x7F,
};

/** touch module function address registers
 */
enum {
    SEESAW_TOUCH_CHANNEL_OFFSET = 0x10,
};

class StemmaSoilSensor : public PollingComponent, public i2c::I2CDevice {
 public:
    void set_temperature_sensor(sensor::Sensor *temperature_sensor) {
        temperature_sensor_ = temperature_sensor;
    }
    void set_moisture_sensor(sensor::Sensor *moisture_sensor) {
        moisture_sensor_ = moisture_sensor;
    }

    float get_setup_priority() const override { return setup_priority::DATA; }

    void setup() override {
        ESP_LOGCONFIG(TAG, "Setting up STEMMA Soil Sensor...");
        ESP_LOGCONFIG(TAG, "  I2C Address: 0x%02X", this->address_);

        // Perform software reset
        ESP_LOGD(TAG, "Sending reset command (0x%02X, 0x%02X, 0xFF)...", SEESAW_STATUS_BASE, SEESAW_STATUS_SWRST);
        auto err = this->write_register(SEESAW_STATUS_BASE, SEESAW_STATUS_SWRST, 0xFF);
        if (!err) {
            ESP_LOGE(TAG, "Failed to write reset command - I2C communication error");
            this->status_set_error();
            return;
        }
        ESP_LOGD(TAG, "Reset command sent successfully, waiting for device to restart...");
        delay(1000);  // Seesaw needs time to reset

        // Check hardware ID
        ESP_LOGD(TAG, "Reading hardware ID (0x%02X, 0x%02X)...", SEESAW_STATUS_BASE, SEESAW_STATUS_HW_ID);
        uint8_t hw_id = 0;
        if (!this->read_register(SEESAW_STATUS_BASE, SEESAW_STATUS_HW_ID, &hw_id, 1, 2000)) {
            ESP_LOGE(TAG, "Failed to read hardware ID - I2C communication error");
            this->status_set_error();
            return;
        }

        ESP_LOGCONFIG(TAG, "Hardware ID read: 0x%02X (expected 0x%02X)", hw_id, SEESAW_HW_ID_CODE);
        if (hw_id != SEESAW_HW_ID_CODE) {
            ESP_LOGE(TAG, "Invalid hardware ID: 0x%02X (expected 0x%02X)", hw_id, SEESAW_HW_ID_CODE);
            this->status_set_error();
            return;
        }

        ESP_LOGCONFIG(TAG, "STEMMA Soil Sensor initialized successfully");
        this->status_clear_error();
    }

    void update() override {
        float temp_c = this->read_temperature();
        uint16_t moisture = this->read_moisture();

        if (this->temperature_sensor_ != nullptr) {
            this->temperature_sensor_->publish_state(temp_c);
        }

        if (this->moisture_sensor_ != nullptr) {
            this->moisture_sensor_->publish_state(moisture);
        }
    }

    void dump_config() override {
        ESP_LOGCONFIG("stemma_soil_sensor", "STEMMA Soil Sensor:");
        LOG_I2C_DEVICE(this);
        LOG_UPDATE_INTERVAL(this);
        LOG_SENSOR("  ", "Temperature", this->temperature_sensor_);
        LOG_SENSOR("  ", "Moisture", this->moisture_sensor_);
    }

 protected:
    sensor::Sensor *temperature_sensor_{nullptr};
    sensor::Sensor *moisture_sensor_{nullptr};

    bool write_register(uint8_t reg_high, uint8_t reg_low, uint8_t value) {
        uint8_t data[3] = {reg_high, reg_low, value};
        return this->write(data, 3) == i2c::ERROR_OK;
    }

    bool read_register(uint8_t reg_high, uint8_t reg_low, uint8_t *buf, uint8_t len, uint16_t delay_us = 125) {
        uint8_t reg[2] = {reg_high, reg_low};
        if (this->write(reg, 2) != i2c::ERROR_OK) {
            return false;
        }

        delayMicroseconds(delay_us);

        return this->read(buf, len) == i2c::ERROR_OK;
    }

    float read_temperature() {
        uint8_t buf[4];
        if (!this->read_register(SEESAW_STATUS_BASE, SEESAW_STATUS_TEMP, buf, 4, 3000)) {
            ESP_LOGW(TAG, "Failed to read temperature");
            return NAN;
        }

        int32_t ret = ((uint32_t)buf[0] << 24) | ((uint32_t)buf[1] << 16) |
                      ((uint32_t)buf[2] << 8) | (uint32_t)buf[3];
        return (1.0 / (1UL << 16)) * ret;
    }

    uint16_t read_moisture() {
        uint8_t buf[2];
        uint8_t pin = 0;
        uint16_t ret = 65535;

        // Retry until valid reading
        int attempts = 0;
        while (ret == 65535 && attempts < 5) {
            delay(5);  // Small delay between attempts
            if (this->read_register(SEESAW_TOUCH_BASE, SEESAW_TOUCH_CHANNEL_OFFSET + pin, buf, 2, 3000)) {
                ret = ((uint16_t)buf[0] << 8) | buf[1];
            }
            attempts++;
        }

        if (ret == 65535) {
            ESP_LOGW(TAG, "Failed to read moisture after %d attempts", attempts);
            return 0;
        }

        return ret;
    }
};

}  // namespace stemma_soil_sensor
}  // namespace esphome