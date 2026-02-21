using Pockitt.Models;

namespace Pockitt.Services;

public class RoomService
{
    private readonly List<Room> _rooms = new();
    private readonly Dictionary<string, CancellationTokenSource> _roomCleanupTimers = new();
    private readonly object _lock = new();

    private const int MaxRoomSize = 10;
    private static readonly TimeSpan EmptyRoomLifetime = TimeSpan.FromMinutes(5);

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

    // Find the closest room with space, or create a new one
    public Room GetOrCreateRoomForUser(User user)
    {
        lock (_lock)
        {
            Room? closestRoom = null;
            double closestDistance = double.MaxValue;

            foreach (var room in _rooms)
            {
                if (room.Users.Count >= MaxRoomSize) continue;

                double distance = CalculateDistance(user.Latitude, user.Longitude, room.Latitude, room.Longitude);
                if (distance < closestDistance)
                {
                    closestDistance = distance;
                    closestRoom = room;
                }
            }

            if (closestRoom != null)
            {
                // Cancel cleanup timer if room was pending deletion
                CancelCleanupTimer(closestRoom.Id);
                return closestRoom;
            }

            // No available room found, create a new one
            return CreateRoom(user.Latitude, user.Longitude);
        }
    }

    public Room CreateRoom(double latitude, double longitude)
    {
        lock (_lock)
        {
            var room = new Room
            {
                Latitude = latitude,
                Longitude = longitude,
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
