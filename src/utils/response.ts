export const successResponse = (message: string, data?: unknown) => {
  return {
    success: true,
    message,
    data: data ?? null,
  };
};

export const errorResponse = (message: string, data?: unknown) => {
  return {
    success: false,
    message,
    data: data ?? null,
  };
};
