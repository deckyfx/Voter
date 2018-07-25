export default abstract class ActionBase {
    protected abstract run(): number;

    protected constructor(public next: Function, public args?: any) {
    }
}
