import ActionBase from "./ActionBase";
import Util from "../Util";
import * as _ from "lodash";
import * as rp from "request-promise-native";
import ProxyConfig from "../models/ProxyConfig";
import ProxyManager from "../repositories/ProxyManager";
import VPNManager from "../repositories/VPNManager";
const ProxyAgent = require("proxy-agent");

export default class Vote extends ActionBase {
    /* Obsolete
    // private static ART_ID                       = [ 288 ]; // Global Theresa Vacation by Young Deer
    // private static ART_ID                       = [ 388 ]; // Koris
    */
    private static ART_ID                       = [ 53 ]; // Koris global final
    /* Obsolete
    // private static GLOBAL_EVENT_URL             = "http://event.global.honkaiimpact3.com/bh3_fans/xmlHttp.php";
    // private static GLOBAL_EVENT_URL             = "http://event.asia.honkaiimpact3.com/bh3_fans/xmlHttp.php";
    */
    // Global Final
    private static GLOBAL_EVENT_URL             = "http://event.global.honkaiimpact3.com/global_summer_finals/summer/vote";    
    private ProxyManager                        = new ProxyManager();
    private VPNManager                          = new VPNManager();

    public static build(args: any, next: Function): void {
        try {
            (new Vote(next, args)).run();
        } catch (e) {
            Util.vorpal.log("Something wrong happened!");
            console.error(e);
        }
    }

    private doVote(config: RequestConfig): Promise<boolean> {
        let proxy_log = "";
        let request_config: any = {
            form: {
                // Like <input type="text" name="name">
                id: config.artid,
                // type: "vote",
            },
            headers: {
                /* 'content-type': 'application/x-www-form-urlencoded' */ // Is set automatically
            },
            method: "POST",
            timeout: 20000, // 20 seconds
            uri: Vote.GLOBAL_EVENT_URL,
        };
        if (config.proxy) {
            let proxy_host = "";
            if (_.includes(config.proxy.type, "HTTP")) {
                proxy_host = `http://${config.proxy.ip}:${config.proxy.port}`;
                proxy_log = `Using HTTP proxy ${config.proxy.ip}:${config.proxy.port} (${config.proxy.location})`;
                request_config.agent = new ProxyAgent(proxy_host);
            } else if (_.includes(config.proxy.type, "HTTPS")) {
                proxy_host = `https://${config.proxy.ip}:${config.proxy.port}`;
                proxy_log = `Using HTTPS proxy ${config.proxy.ip}:${config.proxy.port} (${config.proxy.location})`;
                request_config.agent = new ProxyAgent(proxy_host);
            }
        }
        Util.vorpal.log(`[VOTE] Voting for artwork with id ${config.artid} ${proxy_log}`);
        Util.spinner.start();
        return rp(request_config).then((htmlString: string) => {
            // {"state":0,"msg":"Vote submitted!","data":[]}
            Util.spinner.stop();
            let result = JSON.parse(htmlString);
            if (result.msg === "Vote submitted!" || result.msg === "success") {
                Util.vorpal.log(`[VOTE] ${Util.clc.green("SUCCESS")} voted for artwork with id ${config.artid}`);
                if (result.data) {
                    if (result.data.votes) {
                        Util.vorpal.log(`[VOTE] ${Util.clc.blue("INFO")} Currently has ${result.data.votes} voters`);
                    }
                }
                return Promise.resolve(true);
            } else {
                Util.vorpal.log(`[VOTE] ${Util.clc.red("FAILED")} MiHoYo Replied: "${result.msg}" for artwork with id ${config.artid}`);
                if (result.msg === "Event period has already ended.") {
                    config.retry += 1;
                    if (config.retry >= 10) {
                        return Promise.resolve(false);
                    } else {
                        Util.vorpal.log(`[VOTE] [WAIT] Attempt to retry #${config.retry} after ${20} seconds`);
                        return Util.wait(20000).then(() => {
                            return this.doVote(config);
                        });
                    }
                } else {
                    return Promise.resolve(false);
                }
            }
        })
        .catch((e) => {
                Util.spinner.stop();
                Util.vorpal.log(`[VOTE] ${Util.clc.red("FAILED")} to vote for artwork with id ${config.artid}: ${e.message}`);
                return Promise.resolve(false);
            });
    }

    private voteForAllArts(proxy?: ProxyConfig): Promise<boolean> {
        let args: Array<RequestConfig> = _.map(Vote.ART_ID, (artid: number) => {
            let config = new RequestConfig();
            config.artid = artid;
            config.proxy = proxy;
            return config;
        });
        return Util.SequencePromises<RequestConfig, boolean>(args, this.doVote.bind(this))
        .then(() => {
            return Promise.resolve(true);
        });
    }

    protected run(): number {
        this.ProxyManager.withAllProxies(this.voteForAllArts.bind(this))
        // .then(() => {
        //     return this.VPNManager.withAllVPNs(this.voteForAllArts.bind(this));
        // })
        .then(() => {
            this.next();
        })
        .catch((e) => {
            console.log(e);
            this.next();
        });
        return 0;
    }
}

class RequestConfig {
    public artid= 0;
    public proxy?: ProxyConfig;
    public retry = 0;
}
