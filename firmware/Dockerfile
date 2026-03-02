FROM ghcr.io/esphome/esphome:latest

ENTRYPOINT []

RUN pip install --no-cache-dir fastapi uvicorn[standard]

WORKDIR /firmware-server
COPY server.py .

RUN mkdir -p /output

VOLUME /cache

ENV PLATFORMIO_CORE_DIR=/cache/platformio
ENV ESPHOME_DATA_DIR=/cache/esphome

EXPOSE 5000
CMD ["python3", "-m", "uvicorn", "server:app", "--host", "0.0.0.0", "--port", "5000"]
