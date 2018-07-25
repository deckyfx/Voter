import Vote from "./Vote";

export default abstract class ActionManager {
    public static Vote: typeof Vote = Vote;
}
