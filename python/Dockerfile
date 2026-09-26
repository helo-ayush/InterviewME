# Use python-3.11 slim image
FROM python:3.11-slim

# Prevent python from buffering logs and writing .pyc files
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Expose port 7860 for Hugging Face Spaces health monitoring
ENV PORT=7860
EXPOSE 7860

# Install necessary system dependencies for building libraries
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    g++ \
    python3-dev \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Set up app directory
WORKDIR /app

# Copy dependency configuration and install packages
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy all source files
COPY . .

# Set up permissions for user id 1000 (Hugging Face default)
RUN chmod -R 777 /app

# Start the agent using Python
CMD ["python", "agent.py", "start"]
