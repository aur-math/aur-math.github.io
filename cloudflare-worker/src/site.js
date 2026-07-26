export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/kidmath") {
      url.pathname = "/kidmath/";
      return Response.redirect(url.toString(), 308);
    }

    return env.ASSETS.fetch(request);
  },
};
