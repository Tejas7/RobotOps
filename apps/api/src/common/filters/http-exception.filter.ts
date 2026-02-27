import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from "@nestjs/common";
import type { Response } from "express";

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    if (exception instanceof HttpException) {
      response.status(exception.getStatus()).json({
        error: true,
        statusCode: exception.getStatus(),
        message: exception.message,
        details: exception.getResponse()
      });
      return;
    }

    if (exception instanceof Error) {
      // Surface unexpected runtime failures in server logs during development QA.
      // eslint-disable-next-line no-console
      console.error(exception);
    }

    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      error: true,
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: "Internal server error"
    });
  }
}
