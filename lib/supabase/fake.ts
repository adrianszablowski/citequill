export interface FakeQuery {
    name: string;
    calls: [method: string, ...args: unknown[]][];
}

export function fakeSupabase(answer: (query: FakeQuery) => object) {
    const queries: FakeQuery[] = [];

    function query(name: string, calls: FakeQuery['calls']) {
        const recorded: FakeQuery = { name, calls };

        queries.push(recorded);

        const chain: object = new Proxy(
            {},
            {
                get: (_, method) =>
                    method === 'then'
                        ? (resolve: (result: object) => void) =>
                              resolve({
                                  data: null,
                                  error: null,
                                  ...answer(recorded),
                              })
                        : (...args: unknown[]) => {
                              recorded.calls.push([String(method), ...args]);

                              return chain;
                          },
            },
        );

        return chain;
    }

    return {
        queries,
        writes: () =>
            queries.flatMap(({ name, calls }) =>
                calls
                    .filter(([method]) => writeMethods.has(method))
                    .map(([method]) => `${method} ${name}`),
            ),
        client: {
            from: (table: string) => query(table, []),
            rpc: (name: string, args: object) => query(name, [['rpc', args]]),
        },
    };
}

const writeMethods = new Set(['insert', 'update', 'upsert', 'delete', 'rpc']);
