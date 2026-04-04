type CacheEntry = {
	expires_at: number;
	value: unknown;
};

const cache_values = new Map<string, CacheEntry>();
const in_flight_loads = new Map<string, Promise<unknown>>();
const cache_generations = new Map<string, number>();

const get_generation = (key: string): number => cache_generations.get(key) ?? 0;

const bump_generation = (key: string): void => {
	cache_generations.set(key, get_generation(key) + 1);
};

export const get_or_set_short_ttl_cache = async <T>(
	key: string,
	ttl_ms: number,
	loader: () => Promise<T>
): Promise<T> => {
	const now = Date.now();
	const cached = cache_values.get(key);

	if (cached && cached.expires_at > now) {
		return cached.value as T;
	}

	const existing_load = in_flight_loads.get(key);

	if (existing_load) {
		return (await existing_load) as T;
	}

	const load_generation = get_generation(key);
	const load_promise = (async () => {
		const loaded_value = await loader();

		if (load_generation === get_generation(key)) {
			cache_values.set(key, {
				expires_at: Date.now() + ttl_ms,
				value: loaded_value
			});
		}

		return loaded_value;
	})().finally(() => {
		in_flight_loads.delete(key);
	});

	in_flight_loads.set(key, load_promise);
	return (await load_promise) as T;
};

export const invalidate_short_ttl_cache_key = (key: string): void => {
	bump_generation(key);
	cache_values.delete(key);
	in_flight_loads.delete(key);
};

export const invalidate_short_ttl_cache_prefix = (key_prefix: string): void => {
	for (const key of cache_values.keys()) {
		if (key.startsWith(key_prefix)) {
			bump_generation(key);
			cache_values.delete(key);
		}
	}

	for (const key of in_flight_loads.keys()) {
		if (key.startsWith(key_prefix)) {
			bump_generation(key);
			in_flight_loads.delete(key);
		}
	}
};
