// const winston = require("winston");
const DailyRotateFile = require("winston-daily-rotate-file");
import * as path from "path";
import * as winston from "winston";
import { Logger } from "winston";

export class LogManager {

    private static instance: LogManager;
    private logger: Logger;

    public static getInstance() {
        if (!LogManager.instance) {
            LogManager.instance = new LogManager();
            // ... any one time initialization goes here ...
        }
        return LogManager.instance;
    }

    private constructor() {
        this.logger = winston.createLogger({
            format: winston.format.json(),
            level: "info",
            transports: [
                //
                // - Write to all logs with level `info` and below to `combined.log`
                // - Write all logs error (and below) to `error.log`.
                //
                new winston.transports.Console({ format: winston.format.simple() }),
                new DailyRotateFile({
                    datePattern: "YYYY-MM-DD-HH",
                    filename: path.join(__dirname, "../logs", "log-%DATE%.log"),
                    maxFiles: "14d",
                    maxSize: "20m",
                    zippedArchive: false,
                }),
                new winston.transports.File({ filename: path.join(__dirname, "./logs", "error.log"), level: "error" }),
                new winston.transports.File({ filename: path.join(__dirname, "./logs", "combined.log") }),
            ],
        });
    }

    public get log(): Logger {
        return this.logger;
    }
}

export default LogManager.getInstance().log; // do something with the instance...
