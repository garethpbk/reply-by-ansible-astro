import { getCollection } from 'astro:content';
import type { APIRoute } from 'astro';

export const GET: APIRoute = async ({ url }) => {
  const allEpisodes = await getCollection('episodes');
  const sortedEpisodes = allEpisodes
    .sort((a, b) => b.data.episodeNumber - a.data.episodeNumber)
    .slice(1); // Skip the first episode (shown in hero)

  const offset = parseInt(url.searchParams.get('offset') || '0');
  const limit = parseInt(url.searchParams.get('limit') || '6');

  const episodes = sortedEpisodes.slice(offset, offset + limit);
  const hasMore = offset + limit < sortedEpisodes.length;

  return new Response(
    JSON.stringify({
      episodes: episodes.map(e => e.data),
      hasMore,
      total: sortedEpisodes.length
    }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json'
      }
    }
  );
};

export const prerender = true;
