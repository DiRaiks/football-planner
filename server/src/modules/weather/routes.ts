import { FastifyInstance } from "fastify";

const weatherRoutes = async (fastify: FastifyInstance) => {
  fastify.get(
    "/get",
    { onRequest: [fastify.authenticate] },
    async () => {
      const { OPENWEATHER_API_KEY } = fastify.config;
      const url = new URL("https://api.openweathermap.org/data/2.5/onecall");
      url.searchParams.set("lat", "47.222531");
      url.searchParams.set("lon", "39.718705");
      url.searchParams.set("exclude", "minutely,hourly");
      url.searchParams.set("appid", OPENWEATHER_API_KEY);
      url.searchParams.set("units", "metric");

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Weather API responded with ${response.status}`);
      }

      return response.json();
    },
  );
};

export default weatherRoutes;
