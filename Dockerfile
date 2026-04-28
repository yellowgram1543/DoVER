# Use the official lightweight Node.js 18 image.
FROM node:18-slim

# Install Tesseract and other dependencies for image processing
RUN apt-get update && apt-get install -y \
    tesseract-ocr \
    libtesseract-dev \
    && rm -rf /var/lib/apt/lists/*

# Create and change to the app directory.
WORKDIR /usr/src/app

# Copy application dependency manifests to the container image.
COPY package*.json ./

# Install production dependencies.
RUN npm install --production

# Copy local code to the container image.
COPY . .

# Ensure the uploads directory exists
RUN mkdir -p uploads

# Expose the port the app runs on
EXPOSE 8080

# Run the web service on container startup.
CMD [ "npm", "start" ]
