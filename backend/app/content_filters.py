"""Shared SQL snippets for excluding non-music library rows in legacy Python helpers."""


def podcast_where_clause() -> str:
    return """
    (
      lower(coalesce(tracks.genre, '')) LIKE '%podcast%'
      OR lower(tracks.path) LIKE '%podcast%'
      OR lower(tracks.path) LIKE '%\\podcasts\\%'
      OR lower(tracks.path) LIKE '%/podcasts/%'
      OR EXISTS (
        SELECT 1
        FROM podcast_episodes
        WHERE podcast_episodes.track_id = tracks.id
           OR (
             podcast_episodes.local_path IS NOT NULL
             AND lower(podcast_episodes.local_path) = lower(tracks.path)
           )
      )
    )
    """
