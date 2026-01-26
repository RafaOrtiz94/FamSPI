# Cloud Run Dockerfile for SPI Backend
FROM node:18-alpine

# Crear usuario no-root
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001

# Crear directorio de trabajo
WORKDIR /app

# Copiar archivos de dependencias primero (para cache)
COPY package*.json ./

# Instalar dependencias
RUN npm ci --only=production && npm cache clean --force

# Copiar código fuente
COPY --chown=nodejs:nodejs . .

# Cambiar a usuario no-root
USER nodejs

# Puerto (Cloud Run lo inyecta, pero mantener compatibilidad)
EXPOSE 8080

# Comando de inicio
CMD ["npm", "start"]
