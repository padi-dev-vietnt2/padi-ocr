import { Subject } from 'rxjs';

export type SessionState = {
  stream$: Subject<MessageEvent>;
};
