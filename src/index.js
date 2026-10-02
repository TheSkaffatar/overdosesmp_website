export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // API routes live here. For now this health endpoint confirms that
    // requests can execute Worker code before we add accounts and D1.
    if (url.pathname === "/api/health") {
      return Response.json({
        ok: true,
        service: "OverdoseSMP",
        api: "online"
      }, {
        headers: { "Cache-Control": "no-store" }
      });
    }

    // Everything else is the existing v9 website, unchanged.
    return env.ASSETS.fetch(request);
  }
};
