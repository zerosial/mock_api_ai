export const getBasePath = () => {
  return process.env.NEXT_PUBLIC_BASE_PATH || "";
};

export const withBasePath = (path: string) => {
  const basePath = getBasePath();
  return `${basePath}${path}`;
};
