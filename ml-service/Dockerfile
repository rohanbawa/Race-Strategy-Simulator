# syntax=docker/dockerfile:1
# Python FastAPI ML service. The model is trained at build time and baked into the
# image, so the first request is instant instead of triggering a ~1-minute train.
# The host injects $PORT.

FROM python:3.12-slim
WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .
# Pre-train and cache models/race_winner.joblib into the image.
RUN python train.py

ENV PORT=8000
EXPOSE 8000
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT}"]
