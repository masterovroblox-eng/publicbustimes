FROM node:20-slim AS frontend

WORKDIR /app/

COPY package.json package-lock.json .npmrc /app/
RUN npm ci

COPY frontend /app/frontend
COPY .parcelrc tsconfig.json /app/
RUN npm run lint && npm run build


FROM python:3.13-slim-bookworm

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    git \
    libpq-dev \
    binutils \
    libproj-dev \
    libgeos-dev \
    libgdal-dev \
    gdal-bin \
    && rm -rf /var/lib/apt/lists/*

COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

WORKDIR /app/

COPY uv.lock pyproject.toml /app/
RUN uv sync --frozen

ENV PATH="/app/.venv/bin:$PATH"

COPY --from=frontend /app/node_modules/htmx.org/dist /app/node_modules/htmx.org/dist
COPY --from=frontend /app/node_modules/reqwest/reqwest.min.js /app/node_modules/reqwest/
COPY --from=frontend /app/busstops/static /app/busstops/static
COPY . /app/

COPY start.sh /app/start.sh
RUN chmod +x /app/start.sh

ENV PORT=8000 STATIC_ROOT=/staticfiles
RUN python manage.py collectstatic --noinput

EXPOSE 8000
CMD ["./start.sh"]
