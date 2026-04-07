import type { NextFunction, Request, Response } from "express";
import { ZodError, type ZodSchema } from "zod";
import { ValidationError } from "./errors.js";

export function validate<T extends ZodSchema>(schema: T) {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        next(
          new ValidationError(
            error.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join(", "),
          ),
        );
      } else {
        next(error);
      }
    }
  };
}

export function validateParams<T extends ZodSchema>(schema: T) {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      schema.parse(req.params);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        next(
          new ValidationError(
            error.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join(", "),
          ),
        );
      } else {
        next(error);
      }
    }
  };
}

export function validateQuery<T extends ZodSchema>(schema: T) {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      schema.parse(req.query);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        next(
          new ValidationError(
            error.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join(", "),
          ),
        );
      } else {
        next(error);
      }
    }
  };
}
