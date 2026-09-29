# Public demo seed

`workspace.json` contains synthetic job and practice data for the public Cloud Run demo. It contains no creator or visitor information.

Regenerate it through the same application routes used by the browser:

```sh
npm run demo:seed
```

Every new visitor receives a private temporary copy. The runtime never writes back to this directory.
