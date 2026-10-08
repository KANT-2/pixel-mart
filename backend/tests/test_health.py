async def test_health(client):
    res = await client.get("/api/health")
    assert res.status_code == 200
    assert res.json() == {"status": "ok"}


async def test_docs_available(client):
    res = await client.get("/api/openapi.json")
    assert res.status_code == 200
    assert res.json()["info"]["title"] == "PIXEL MART API"
