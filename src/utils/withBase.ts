const base = import.meta.env.BASE_URL;
export const withBase = (path = "") => `${base.replace(/\/?$/, "/")}${path.replace(/^\//, "")}`;
