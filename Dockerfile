FROM node
COPY package.json webpack.config.js .babelrc /app/
COPY src/ /app/src/
WORKDIR /app/
RUN npm install && npm run build

FROM nginx:alpine
COPY --from=0 /app/dist /usr/share/nginx/html