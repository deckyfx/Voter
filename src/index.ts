import Util from "./Util";
import ActionManager from "./actions/ActionManager";

export class Startup {
    public static main(): number {
        // Should connect to monggose
        Util.vorpal
            .command("vote")
            .description("Vote for Image art")
            .action(ActionManager.Vote.build);

        Util.vorpal
            .delimiter(Util.clc.blue("voter$"))
            .parse(process.argv)
            .show();
        return 0;
    }
}

Startup.main();
