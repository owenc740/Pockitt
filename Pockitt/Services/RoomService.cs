using Pockitt.Models;

namespace Pockitt.Services;

public class RoomService
{
    private readonly List<Room> _rooms = new();
    private readonly Dictionary<string, CancellationTokenSource> _roomCleanupTimers = new();
    private readonly object _lock = new();

    private const int MaxRoomSize = 10;
    private const double ProximityThresholdMiles = 0.062; // ~100 meters, roughly one football field
    private static readonly TimeSpan EmptyRoomLifetime = TimeSpan.FromMinutes(5);

    private const string Base32 = "0123456789bcdefghjkmnpqrstuvwxyz";

    // Decodes a geohash to the center lat/lng of its bounding box
    private static (double lat, double lng) DecodeGeohash(string geohash)
    {
        double minLat = -90, maxLat = 90;
        double minLng = -180, maxLng = 180;
        bool evenBit = true;

        foreach (char c in geohash)
        {
            int idx = Base32.IndexOf(c);
            for (int bits = 4; bits >= 0; bits--)
            {
                int bitN = (idx >> bits) & 1;
                if (evenBit)
                {
                    double midLng = (minLng + maxLng) / 2;
                    if (bitN == 1) minLng = midLng;
                    else maxLng = midLng;
                }
                else
                {
                    double midLat = (minLat + maxLat) / 2;
                    if (bitN == 1) minLat = midLat;
                    else maxLat = midLat;
                }
                evenBit = !evenBit;
            }
        }

        return ((minLat + maxLat) / 2, (minLng + maxLng) / 2);
    }

    // Haversine formula — calculates distance in miles between two coordinates
    private static double CalculateDistance(double lat1, double lon1, double lat2, double lon2)
    {
        const double earthRadiusMiles = 3958.8;
        double dLat = ToRadians(lat2 - lat1);
        double dLon = ToRadians(lon2 - lon1);

        double a = Math.Sin(dLat / 2) * Math.Sin(dLat / 2) +
                   Math.Cos(ToRadians(lat1)) * Math.Cos(ToRadians(lat2)) *
                   Math.Sin(dLon / 2) * Math.Sin(dLon / 2);

        double c = 2 * Math.Atan2(Math.Sqrt(a), Math.Sqrt(1 - a));
        return earthRadiusMiles * c;
    }

    private static double ToRadians(double degrees) => degrees * (Math.PI / 180);

    // Find the closest room within one football field; fall back to the absolute closest with space
    public Room GetOrCreateRoomForUser(User user)
    {
        lock (_lock)
        {
            var (userLat, userLng) = DecodeGeohash(user.Geohash);

            Room? closestNearby = null;
            Room? closestAny = null;
            double closestNearbyDist = double.MaxValue;
            double closestAnyDist = double.MaxValue;

            foreach (var room in _rooms)
            {
                if (room.Users.Count >= MaxRoomSize) continue;

                var (roomLat, roomLng) = DecodeGeohash(room.Geohash);
                double distance = CalculateDistance(userLat, userLng, roomLat, roomLng);

                if (distance <= ProximityThresholdMiles && distance < closestNearbyDist)
                {
                    closestNearbyDist = distance;
                    closestNearby = room;
                }

                if (distance < closestAnyDist)
                {
                    closestAnyDist = distance;
                    closestAny = room;
                }
            }

            var match = closestNearby ?? closestAny;
            if (match != null)
            {
                CancelCleanupTimer(match.Id);
                return match;
            }

            return CreateRoom(user.Geohash);
        }
    }

    public Room CreateRoom(string geohash)
    {
        lock (_lock)
        {
            var room = new Room
            {
                Geohash = geohash,
                Name = $"Room {_rooms.Count + 1}"
            };
            _rooms.Add(room);
            return room;
        }
    }

    public void AddUserToRoom(User user, Room room)
    {
        lock (_lock)
        {
            room.Users.Add(user);
            user.RoomId = room.Id;
        }
    }

    public void RemoveUser(User user)
    {
        lock (_lock)
        {
            var room = _rooms.FirstOrDefault(r => r.Id == user.RoomId);
            if (room == null) return;

            room.Users.RemoveAll(u => u.ConnectionId == user.ConnectionId);

            if (room.Users.Count == 0)
            {
                ScheduleRoomCleanup(room.Id);
            }
        }
    }

    public Room? GetRoom(string roomId)
    {
        lock (_lock)
        {
            return _rooms.FirstOrDefault(r => r.Id == roomId);
        }
    }

    public List<Room> GetAllRooms()
    {
        lock (_lock)
        {
            return _rooms.ToList();
        }
    }

    private void ScheduleRoomCleanup(string roomId)
    {
        var cts = new CancellationTokenSource();
        _roomCleanupTimers[roomId] = cts;

        Task.Delay(EmptyRoomLifetime, cts.Token).ContinueWith(t =>
        {
            if (t.IsCanceled) return;

            lock (_lock)
            {
                var room = _rooms.FirstOrDefault(r => r.Id == roomId);
                if (room != null && room.Users.Count == 0)
                {
                    _rooms.Remove(room);
                    _roomCleanupTimers.Remove(roomId);
                }
            }
        });
    }

    private void CancelCleanupTimer(string roomId)
    {
        if (_roomCleanupTimers.TryGetValue(roomId, out var cts))
        {
            cts.Cancel();
            _roomCleanupTimers.Remove(roomId);
        }
    }
}
