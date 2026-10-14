# syntax=docker/dockerfile:1
# Imagen del backend para Render (o cualquier host Docker). Dos etapas: compilar con el wrapper de Maven
# y ejecutar con un JRE 21 ligero.

FROM eclipse-temurin:21-jdk-alpine AS build
WORKDIR /app
COPY .mvn .mvn
COPY mvnw pom.xml ./
RUN chmod +x mvnw && ./mvnw -q -B dependency:go-offline || true
COPY src src
RUN ./mvnw -q -B -DskipTests package && cp target/*.jar /app/app.jar

FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
COPY --from=build /app/app.jar app.jar
# El contenedor nunca debe intentar levantar docker compose; el resto de ajustes van por variables de entorno.
ENV SPRING_DOCKER_COMPOSE_ENABLED=false \
    JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=60 -XX:+UseSerialGC"
EXPOSE 8090
ENTRYPOINT ["java", "-jar", "app.jar"]
