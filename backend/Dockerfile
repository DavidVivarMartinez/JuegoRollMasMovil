# syntax=docker/dockerfile:1
# Imagen del backend para Render (o cualquier host Docker).
# El plan gratuito de Render da ~0.1 CPU: sin ayudas, Spring tarda varios minutos en arrancar. Por eso:
#  - el jar se extrae por capas y se genera una caché de clases (CDS) con un arranque de entrenamiento;
#  - el JIT se limita al compilador rápido (C1), que en una CPU tan pequeña arranca mucho antes.

FROM eclipse-temurin:21-jdk-alpine AS build
WORKDIR /app
COPY .mvn .mvn
COPY mvnw pom.xml ./
RUN chmod +x mvnw && ./mvnw -q -B dependency:go-offline || true
COPY src src
RUN ./mvnw -q -B -DskipTests package \
 && java -Djarmode=tools -jar target/*.jar extract --destination /app/extracted

FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
COPY --from=build /app/extracted/ ./
# Mismas opciones de JVM en el entrenamiento y en el arranque real (si no, la caché no se usa)
ENV SPRING_DOCKER_COMPOSE_ENABLED=false \
    JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=60 -XX:+UseSerialGC"
# Arranque de entrenamiento: levanta el contexto sin base de datos y sale, dejando la caché de clases en app.jsa
RUN java -XX:TieredStopAtLevel=1 -XX:ArchiveClassesAtExit=app.jsa \
      -Dspring.context.exit=onRefresh \
      -Dspring.flyway.enabled=false \
      -Dspring.jpa.hibernate.ddl-auto=none \
      -Dspring.jpa.database-platform=org.hibernate.dialect.PostgreSQLDialect \
      -Dspring.jpa.properties.hibernate.boot.allow_jdbc_metadata_access=false \
      -Dapp.seed.enabled=false \
      -jar /app/*.jar || echo "Aviso: no se pudo generar la caché CDS; se arrancará sin ella"
EXPOSE 8090
# Si app.jsa no existe o no encaja, la JVM solo avisa y arranca igual
ENTRYPOINT ["sh", "-c", "exec java -XX:TieredStopAtLevel=1 -XX:SharedArchiveFile=app.jsa -Xshare:auto -jar /app/*.jar"]
