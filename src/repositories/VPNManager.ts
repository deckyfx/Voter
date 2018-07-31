import Util from "../Util";
import * as cp from "child_process";
import * as rp from "request-promise-native";
import * as qs from "querystring";
import * as _ from "lodash";
import * as path from "path";
import * as fs from "fs";
import VPNGate from "../models/VPNGate";
import { JSDOM } from "jsdom";
const wget = require("wget-improved");

export default class VPNManager {
    private static VPN_GATE                     = "http://www.vpngate.net/en/";
    private vpn: any;
    private action?: () => Promise<boolean>;

    private connectVPN(configpath: string): Promise<boolean> {
        Util.vorpal.log(`[VPN] Connect to VPN with config file ${configpath}`);
        Util.spinner.start();
        return new Promise<boolean>( (resolve, reject) => {
            this.vpn = cp.exec(`sudo openvpn ${configpath}`);
            this.vpn!.stdout.on("data", (data: any) => {
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
            this.vpn!.stderr.on("data", (data: any) => {
                Util.spinner.stop();
                // console.log(`stderr: ${data}`);
            });
            this.vpn!.on("close", (code: any) => {
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
            uri: VPNManager.VPN_GATE,
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
                gate.country_flag = `${VPNManager.VPN_GATE}${rows[0].querySelector("img")!.getAttribute("src")!}`;
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
                gate.config_page_url = `${VPNManager.VPN_GATE}${href}`;
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
                hrefs.push(VPNManager.VPN_GATE.replace("/en/", href));
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

    public whatsIsMyIP(): Promise<boolean> {
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
                return Util.wait(5000)
                .then((_result) => {
                    return this.whatsIsMyIP();
                })
                .then((_result) => {
                    return this.action!();
                })
                .then((_result) => {
                    return this.disconnectVPN();
                })
                .then((_result) => {
                    return Util.wait(5000);
                });
            })
            .catch((e) => {
                return Promise.resolve(false);
            });
        });
    }

    public withAllVPNs(action: () => Promise<boolean>): Promise<Array<boolean>> {
        this.action = action;
        return this.getVPNConfigs()
        .then((gates) => {
            return Util.SequencePromises<VPNGate, boolean>(gates, this.connectToVPNandVote.bind(this));
        });
    }
}

export class VPNGateRunConfig {
}
