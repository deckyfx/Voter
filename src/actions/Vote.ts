import ActionBase from "./ActionBase";
import Util from "../Util";
import ModelManager from "../models/ModelManager";
import VPNGate from "../models/VPNGate";
import * as cp from "child_process";
import * as fs from "fs";
import * as path from "path";
import * as _ from "lodash";
import * as qs from "querystring";
import * as rp from "request-promise-native";
import { JSDOM } from "jsdom";
import { request, IncomingMessage } from "http";
import { config } from "rx";
import ProxyConfig from "../models/ProxyConfig";
const wget = require("wget-improved");
const ProxyAgent = require("proxy-agent");

export default class Vote extends ActionBase {
    private static ART_ID                       = 126; // Global Theresa Vacation by Young Deer
    private static VPN_GATE                     = "http://www.vpngate.net/en/";
    private static ASIA_EVENT_URL               = "http://event.asia.honkaiimpact3.com/bh3_fans/xmlHttp.php";
    private static GLOBAL_EVENT_URL             = "http://event.global.honkaiimpact3.com/bh3_fans/xmlHttp.php";
    private static PROXY_LIST                   = "https://free-proxy-list.net/";
    private vpn: cp.ChildProcess | null = null;

    public static build(args: any, next: Function): void {
        try {
            (new Vote(next, args)).run();
        } catch (e) {
            Util.vorpal.log("Something wrong happened!");
            console.error(e);
        }
    }

    private connectVPN(configpath: string): Promise<boolean> {
        Util.vorpal.log(`[VPN] Connect to VPN with config file ${configpath}`);
        Util.spinner.start();
        return new Promise<boolean>( (resolve, reject) => {
            this.vpn = cp.exec(`sudo openvpn ${configpath}`);
            this.vpn!.stdout.on("data", (data) => {
                Util.spinner.stop();
                // console.log(`stdout: ${data}`);
                if (data.toString().match("Initialization Sequence Completed") != null) {
                    Util.vorpal.log(`[VPN] ${Util.clc.green("SUCCESS")} Connected to VPN!`);
                    resolve(true);
                }
                if (data.toString().match("AUTH_FAILED") != null) {
                    Util.vorpal.log(`[VPN] ${Util.clc.red("FAILED")} to connect to VPN!`);
                    reject(true);
                }
            });
            this.vpn!.stderr.on("data", (data) => {
                Util.spinner.stop();
                // console.log(`stderr: ${data}`);
            });
            this.vpn!.on("close", (code) => {
                Util.spinner.stop();
                Util.vorpal.log(`[VPN] ${Util.clc.yellow("WARN")} Disonnected from VPN!`);
                // console.log(`child process exited with code ${code}`);
                if (code == null) {
                    reject(true);
                }
            });
        });
    }

    private disconnectVPN(): Promise<boolean> {
        Util.vorpal.log(`Kill VPN connection`);
        Util.spinner.start();
        cp.exec("killall openvpn",
        (err, stdout, stderr) => {
            this.vpn = null;
        });
        if (this.vpn != null) {
            cp.exec(`taskkill /PID ${this.vpn.pid} /T /F`, function (error, stdout, stderr) {
                // more debug if you need
                // console.log('stdout: ' + stdout);
                // console.log('stderr: ' + stderr);
                // if(error !== null) {
                //      console.log('exec error: ' + error);
                // }
            });
        }
        this.vpn = null;
        Util.spinner.stop();
        return Promise.resolve(true);
    }

    private smartConnectVPN(configpath: string): Promise<boolean> {
        if (this.vpn != null) {
            return this.disconnectVPN()
            .then(() => {
                return this.connectVPN(configpath);
            });
        } else {
            return this.connectVPN(configpath);
        }
    }

    private getVPNConfigs(): Promise<Array<VPNGate>> {
        Util.vorpal.log("[VPN] Collecting VPN Gates");
        Util.spinner.start();
        return rp({
            method: "GET",
            uri: Vote.VPN_GATE,
        }).then((htmlString: string) => {
            const dom = new JSDOM(htmlString);
            const document = dom.window.document;
            const tables = document.querySelectorAll("table#vg_hosts_table_id");
            const trs = tables[tables.length - 1].querySelectorAll("tr");
            let results: Array<VPNGate> = new Array<VPNGate>();
            for (let tr of trs) {
                let rows = tr.querySelectorAll("td");
                if (rows[0].className === "vg_table_header") {
                    continue;
                }
                let anchor = rows[6].querySelector("a");
                if (!anchor) {
                    continue;
                }
                let gate = new VPNGate();
                gate.country = rows[0].textContent!;
                gate.country_flag = `${Vote.VPN_GATE}${rows[0].querySelector("img")!.getAttribute("src")!}`;
                let spans = rows[1].querySelectorAll("span");
                gate.ddns = spans[0].textContent!;
                gate.ip = spans[1].textContent!;
                gate.isphost = (spans[2]) ? spans[2].textContent! : "";
                let runtimetexts = rows[2].textContent!.split(/(\s|sessions|total|users)/i)
                    .filter((c) => {
                        c = c.trim().toLowerCase();
                        return c.length > 0 && !["sessions", "total", "users"].includes(c);
                    });
                gate.session = parseInt(runtimetexts[0], undefined);
                // @ts-ignore
                gate.uptimes = Util.moment.duration(parseInt(runtimetexts[1], undefined), runtimetexts[2]).as("hour");
                gate.total_user = parseInt(runtimetexts[3].replace(",", ""), undefined);
                let qualitytexts = rows[3].textContent!.split(/(\s|ps|Ping\:\s|ms|Logging\spolicy\:)/i)
                    .filter((c) => {
                        c = c.trim().toLowerCase();
                        return c.length > 0 && !["ps", "ping:", "logging policy:"].includes(c);
                    });
                if (qualitytexts.length === 6) {
                    // ping may unavailable
                    qualitytexts.splice(2, 0, "-1");
                    qualitytexts.splice(3, 0, "ms");
                }
                gate.line_quality = Util.convert(parseFloat(qualitytexts[0])).from(qualitytexts[1]).to("Mb");
                // @ts-ignore
                gate.ping = Util.moment.duration(parseInt(qualitytexts[2], undefined), qualitytexts[3]).as("ms");
                gate.total_transfer = Util.convert(parseInt(qualitytexts[4].replace(",", ""), undefined)).from(qualitytexts[5]).to("GB");
                // @ts-ignore
                gate.loging_policy = Util.moment.duration(parseInt(qualitytexts[6], undefined), qualitytexts[7]).as("hours");
                let href = anchor!.getAttribute("href")!;
                let porttexts = qs.parse(href);
                gate.config_page_url = `${Vote.VPN_GATE}${href}`;
                gate.tcp = parseInt(porttexts.tcp as string, undefined);
                gate.udp = parseInt(porttexts.udp as string, undefined);
                gate.fqdn = porttexts.fqdn as string;
                gate.sid = parseInt(porttexts.sid as string, undefined);
                gate.hid = parseInt(porttexts.hid as string, undefined);
                gate.operator_name = rows[8].textContent!.trim();
                gate.score = parseInt(rows[9].textContent!.replace(",", ""), undefined);
                results.push(gate);
            }
            Util.spinner.stop();
            Util.vorpal.log(`[VPN] ${Util.clc.green("SUCCESS")} Obtained ${results.length} active VPNs`);
            return Promise.resolve( _.orderBy(results, "score", "desc" ) );
        }).catch((e) => {
            Util.spinner.stop();
            Util.vorpal.log(`[VPN] ${Util.clc.red("FAILED")} to get vpns`);
            return Promise.reject(e);
        });
    }

    private getVPNConfigFiles(gate: VPNGate): Promise<VPNGate> {
        Util.vorpal.log(`[VPN] Obtain ovpn configs url for ${gate.ddns} (${gate.ip})`);
        Util.spinner.start();
        return rp({
            method: "GET",
            uri: gate.config_page_url!,
        }).then((htmlString: string) => {
            const dom = new JSDOM(htmlString);
            const document = dom.window.document;
            const anchors = document.querySelectorAll("ul.listBigArrow a");
            let hrefs: Array<string> = new Array<string>();
            for (let anchor of anchors) {
                let href = anchor.getAttribute("href")!;
                if (!_.endsWith(href.toLowerCase(), "ovpn")) {
                    continue;
                }
                hrefs.push(Vote.VPN_GATE.replace("/en/", href));
            }
            Util.spinner.stop();
            Util.vorpal.log(`[VPN] ${Util.clc.green("SUCCESS")} Obtained ${hrefs.length} ovpn urls`);
            gate.config_file_urls = hrefs;
            return Promise.resolve(gate);
        })
        .then((_gate) => {
            return Util.SequencePromises<string, string>(gate.config_file_urls!, this.downloadConfigFile)
            .then((result) => {
                _gate.config_files = result;
                return Promise.resolve(_gate);
            });
        });
    }

    private downloadConfigFile(url: string): Promise<string> {
        let urls = url.split("&/");
        Util.vorpal.log(`[VPN] Downloading ${urls[0]}`);
        Util.spinner.start();
        return new Promise<string>((resolve, reject) => {
            // extract filename
            let filenames = urls[1];
            // create file write stream
            let filepath = path.join(".", "vpnconfigs", filenames);
            let fws = fs.createWriteStream( filepath );
            let download = wget.download(urls[0], filepath, {});
            download.on("error", function(err: any) {
                Util.spinner.stop();
                reject(err);
            });
            download.on("start", function(fileSize: any) {
                // console.log(fileSize);
            });
            download.on("end", function(output: any) {
                Util.spinner.stop();
                Util.vorpal.log(`[VPN] ${Util.clc.green("SUCCESS")} Downloaded to ${filepath}`);
                resolve(filepath);
            });
            download.on("progress", function(progress: any) {
                // typeof progress === 'number' ? () : ();
            });
        });
    }

    private getProxyList(): Promise<Array<ProxyConfig>> {
        Util.vorpal.log("[PROXY] Collecting Proxy list");
        Util.spinner.start();
        // tslint:disable-next-line:max-line-length
        let _rp = rp.defaults({jar: true});
        return _rp({
            headers: {
                // tslint:disable-next-line:max-line-length
                "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/68.0.3440.68 Safari/537.36",
            },
            method: "GET",
            uri: Vote.PROXY_LIST,
        }).then((htmlString: string) => {
            const dom = new JSDOM(htmlString);
            const document = dom.window.document;
            const trs = document.querySelectorAll("table.table.table-striped.table-bordered tbody tr");
            let results: Array<ProxyConfig> = new Array<ProxyConfig>();
            for (let tr of trs) {
                let rows = tr.querySelectorAll("td");
                let proxy = new ProxyConfig();
                proxy.ip = rows[0].textContent!;
                proxy.port = parseInt(rows[1].textContent!, undefined);
                proxy.location = rows[3].textContent!;
                proxy.country_flag = "";
                // @ts-ignore
                proxy.ping = 0;
                proxy.type = (rows[6].textContent!.toLowerCase() === "yes") ? ["HTTP"] : [ "HTTPS"];
                proxy.anonymity = rows[4].textContent!;
                let lastchecktexts = rows[7].textContent!.split(/\s/i);
                // @ts-ignore
                proxy.lastcheck = Util.moment.duration(parseInt(lastchecktexts[0], undefined), lastchecktexts[1]).as("minute");
                results.push(proxy);
            }
            Util.spinner.stop();
            Util.vorpal.log(`[PROXY] ${Util.clc.green("SUCCESS")} Obtained ${results.length} active Proxies`);
            return Promise.resolve( _.orderBy(results, "ping", "asc" ) );
        });
    }

    private doVote(proxy?: ProxyConfig): Promise<boolean> {
        let proxy_log = "";
        let request_config: any = {
            form: {
                // Like <input type="text" name="name">
                id: Vote.ART_ID,
                type: "vote",
            },
            headers: {
                /* 'content-type': 'application/x-www-form-urlencoded' */ // Is set automatically
            },
            method: "POST",
            timeout: 20000, // 20 seconds
            uri: Vote.GLOBAL_EVENT_URL,
        };
        if (proxy) {
            let proxy_host = "";
            if (_.includes(proxy.type, "HTTP")) {
                proxy_host = `http://${proxy.ip}:${proxy.port}`;
                proxy_log = `Using HTTP proxy ${proxy.ip}:${proxy.port} (${proxy.location})`;
                request_config.agent = new ProxyAgent(proxy_host);
            } else if (_.includes(proxy.type, "HTTPS")) {
                proxy_host = `https://${proxy.ip}:${proxy.port}`;
                proxy_log = `Using HTTPS proxy ${proxy.ip}:${proxy.port} (${proxy.location})`;
                request_config.agent = new ProxyAgent(proxy_host);
            }
        }
        Util.vorpal.log(`[VOTE] Voting for artwork with id ${Vote.ART_ID} ${proxy_log}`);
        Util.spinner.start();
        return rp(request_config).then((htmlString: string) => {
            // {"state":0,"msg":"Vote submitted!","data":[]}
            Util.spinner.stop();
            let result = JSON.parse(htmlString);
            if (result.msg === "Vote submitted!") {
                Util.vorpal.log(`[VOTE] ${Util.clc.green("SUCCESS")} voted for artwork with id ${Vote.ART_ID}`);
                return Promise.resolve(true);
            } else {
                Util.vorpal.log(`[VOTE] ${Util.clc.red("FAILED")} Already voted for artwork with id ${Vote.ART_ID}`);
                return Promise.resolve(false);
            }
        })
        .catch((e) => {
            Util.spinner.stop();
            Util.vorpal.log(`[VOTE] ${Util.clc.red("FAILED")} to vote for artwork with id ${Vote.ART_ID}`);
            return Promise.resolve(false);
        });
    }

    private wait(second: number): Promise<boolean> {
        Util.vorpal.log(`[WAIT] for ${second} ms`);
        Util.spinner.start();
        return new Promise<boolean>( (resolve, reject) => {
            setTimeout(() => {
                Util.spinner.stop();
                resolve(true);
            }, second);
        });
    }

    private whatsIsMyIP(): Promise<boolean> {
        Util.vorpal.log(`[GETIP] Checking current IP Address`);
        Util.spinner.start();
        return rp({
            headers: {
                // tslint:disable-next-line:max-line-length
                "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/68.0.3440.68 Safari/537.36",
            },
            method: "GET",
            uri: "https://www.iplocation.net/",
        }).then((htmlString: string) => {
            // {"state":0,"msg":"Vote submitted!","data":[]}
            const dom = new JSDOM(htmlString);
            const document = dom.window.document;
            let datas = document.querySelectorAll("table.table_dark_green tbody td");
            let ip = datas[0].textContent!;
            let location = datas[1].textContent!;
            Util.spinner.stop();
            Util.vorpal.log(`[GETIP] ${Util.clc.green("SUCCESS")} ${ip} ${location}`);
            return Promise.resolve(true);
        });
    }

    private connectToVPNandVote(gate: VPNGate): Promise<boolean> {
        return this.whatsIsMyIP()
        .then((result) => {
            return this.getVPNConfigFiles(gate);
        })
        .then((_gate) => {
            return this.smartConnectVPN(_gate.config_files![0])
            .then((result) => {
                return this.wait(5000)
                .then((_result) => {
                    return this.whatsIsMyIP();
                })
                .then((_result) => {
                    return this.doVote();
                })
                .then((_result) => {
                    return this.disconnectVPN();
                })
                .then((_result) => {
                    return this.wait(5000);
                });
            })
            .catch((e) => {
                return Promise.resolve(false);
            });
        });
    }

    private voteWithAllVPNs(): Promise<Array<boolean>> {
        return this.getVPNConfigs()
        .then((gates) => {
            gates = gates.slice(0, 4);
            return Util.SequencePromises<VPNGate, boolean>(gates, this.connectToVPNandVote.bind(this));
        });
    }

    private getAllProxyAndVote(): Promise<Array<boolean>> {
        return this.getProxyList()
        .then((proxies) => {
            // proxies = proxies.slice(0, 4);
            return Util.SequencePromises<ProxyConfig, boolean>(proxies, this.doVote.bind(this));
        });
    }

    protected run(): number {
        this.disconnectVPN().then((result) => {
            return this.whatsIsMyIP();
        })
        .then(() => {
            return this.getAllProxyAndVote();
        })
        // enable this to vote using VPN too
        // .then(() => {
        //     return this.voteWithAllVPNs();
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
