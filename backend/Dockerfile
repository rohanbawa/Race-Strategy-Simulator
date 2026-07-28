# syntax=docker/dockerfile:1
# Java Spring Boot backend — build the fat jar, then run it on a slim JRE.
# Portable to any container host (Render, Railway, Fly.io, Cloud Run): they inject
# $PORT, which we pass through to Spring's server.port.

# --- build stage ---
FROM maven:3.9-eclipse-temurin-17 AS build
WORKDIR /app
COPY pom.xml .
RUN mvn -q -B dependency:go-offline
COPY src ./src
RUN mvn -q -B clean package -DskipTests

# --- run stage ---
FROM eclipse-temurin:17-jre
WORKDIR /app
COPY --from=build /app/target/*.jar app.jar
ENV PORT=8080
EXPOSE 8080
# MaxRAMPercentage keeps the JVM within small (512MB) container limits.
ENTRYPOINT ["sh", "-c", "java -XX:MaxRAMPercentage=75 -Dserver.port=${PORT} -jar app.jar"]
