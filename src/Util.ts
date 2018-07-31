import LogManager from "./utils/LogManager";
import { Logger } from "winston";
import * as moment from "moment";
const vorpal = require("vorpal");
const clc = require("cli-color");
const CLI = require("clui");
const convert = require("convert-units");

export class Util {
    private static instance: Util;

    public Loger: Logger = LogManager;
    // public mongo: MongoDB = MongoDBInstance;
    public clc = clc;
    public spinner: any;
    public vorpal: any;
    public CLI = CLI;
    public moment = moment;
    public convert = convert;

    public static getInstance() {
        if (!Util.instance) {
            Util.instance = new Util();
            // ... any one time initialization goes here ...
        }
        return Util.instance;
    }

    public SequencePromises<K, T>(promise_argument: Array<K>, task: (input: K) => Promise<T>): Promise<Array<T>> {
        let results: Array<T> = new Array<T>();
        let start_promise = promise_argument.reduce((promise: Promise<T | void>, argument) => {
            return promise.then((result) => {
                if (result) {
                    results.push(result);
                }
                return task(argument);
            });
        }, Promise.resolve()); // initial
        return new Promise<Array<T>>((resolve, reject) => {
            return start_promise.then((result) => {
                if (result) {
                    results.push(result);
                }
                resolve(results);
            }).catch((e: any) => {
                reject(e);
            });
        });
    }

    public wait(second: number): Promise<boolean> {
        this.spinner.stop();
        this.vorpal.log(`[WAIT] for ${second} ms`);
        this.spinner.start();
        return new Promise<boolean>( (resolve, reject) => {
            setTimeout(() => {
                this.spinner.stop();
                resolve(true);
            }, second);
        });
    }

    private test(test: string): Promise<number> {
        return Promise.resolve(0);
    }

    private constructor() {
        this.SequencePromises<string, number>([], this.test);
        this.vorpal = vorpal();
        this.spinner = new CLI.Spinner("Processing...");
    }
}

export default Util.getInstance(); // do something with the instance...
