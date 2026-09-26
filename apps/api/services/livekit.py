from datetime import timedelta

from livekit.api import AccessToken, CreateRoomRequest, LiveKitAPI, VideoGrants

from config import settings


def is_configured() -> bool:
    return bool(settings.livekit_url and settings.livekit_api_key and settings.livekit_api_secret)


async def ensure_room(room_name: str) -> None:
    api = LiveKitAPI(settings.livekit_url, settings.livekit_api_key, settings.livekit_api_secret)
    try:
        await api.room.create_room(CreateRoomRequest(name=room_name, empty_timeout=300, max_participants=4))
    finally:
        await api.aclose()


def mint_participant_token(room_name: str, identity: str, name: str) -> str:
    token = (
        AccessToken(settings.livekit_api_key, settings.livekit_api_secret)
        .with_identity(identity)
        .with_name(name)
        .with_grants(VideoGrants(room_join=True, room=room_name))
        .with_ttl(timedelta(hours=3))
    )
    return token.to_jwt()
