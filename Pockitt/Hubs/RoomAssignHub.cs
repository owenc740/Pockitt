using Microsoft.AspNetCore.SignalR;
using Pockitt.Models;
using Pockitt.Services;

namespace Pockitt.Hubs;

public class RoomAssignHub : Hub
{
    private readonly RoomService _roomService;
    private static readonly Dictionary<string, User> _connectedUsers = new();       // connectionId -> User
    private static readonly Dictionary<string, User> _disconnectedUsers = new();    // sessionToken -> User
    private static readonly Dictionary<string, CancellationTokenSource> _disconnectTimers = new(); // sessionToken -> Timer
    private static readonly object _lock = new();

    private static readonly TimeSpan ReconnectGracePeriod = TimeSpan.FromMinutes(5);

    public RoomAssignHub(RoomService roomService)
    {
        _roomService = roomService;
    }

public async Task Join(string username, string geohash, string? sessionToken = null)
    {
        User? existingUser = null;

        if (sessionToken != null)
        {
            lock (_lock)
            {
                _disconnectedUsers.TryGetValue(sessionToken, out existingUser);

                if (existingUser != null)
                {
                    if (_disconnectTimers.TryGetValue(sessionToken, out var cts))
                    {
                        cts.Cancel();
                        _disconnectTimers.Remove(sessionToken);
                    }

                    _disconnectedUsers.Remove(sessionToken);
                    existingUser.ConnectionId = Context.ConnectionId;
                    _connectedUsers[Context.ConnectionId] = existingUser;
                }
            }
        }

        if (existingUser != null)
        {
            await Groups.AddToGroupAsync(Context.ConnectionId, existingUser.RoomId);

            var existingRoom = _roomService.GetRoom(existingUser.RoomId);

            // Notify others that user rejoined
            await Clients.OthersInGroup(existingUser.RoomId).SendAsync("UserRejoined", new
            {
                username = existingUser.Username,
                userCount = existingRoom?.Users.Count
            });

            await Clients.Caller.SendAsync("RoomJoined", new
            {
                roomId = existingUser.RoomId,
                roomName = existingRoom?.Name,
                userCount = existingRoom?.Users.Count,
                sessionToken = existingUser.SessionToken,
                reconnected = true
            });
            return;
        }

        // New user
        var user = new User
        {
            ConnectionId = Context.ConnectionId,
            Username = username,
            Geohash = geohash
        };

        var room = _roomService.GetOrCreateRoomForUser(user);
        _roomService.AddUserToRoom(user, room);

        lock (_lock)
        {
            _connectedUsers[Context.ConnectionId] = user;
        }

        await Groups.AddToGroupAsync(Context.ConnectionId, room.Id);

        await Clients.Caller.SendAsync("RoomJoined", new
        {
            roomId = room.Id,
            roomName = room.Name,
            userCount = room.Users.Count,
            sessionToken = user.SessionToken,
            reconnected = false
        });

        await Clients.OthersInGroup(room.Id).SendAsync("UserJoined", new
        {
            username = user.Username,
            userCount = room.Users.Count
        });
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        Console.WriteLine($"[Disconnect] ConnectionId: {Context.ConnectionId}");
        
        User? user;
        lock (_lock)
        {
            _connectedUsers.TryGetValue(Context.ConnectionId, out user);
            if (user != null)
            {
                _connectedUsers.Remove(Context.ConnectionId);
                _disconnectedUsers[user.SessionToken] = user;
            }
        }

        if (user != null)
        {
            var cts = new CancellationTokenSource();
            var sessionToken = user.SessionToken;
            var roomId = user.RoomId;

            lock (_lock)
            {
                _disconnectTimers[sessionToken] = cts;
            }

            // Immediately notify room that user disconnected
            var room = _roomService.GetRoom(roomId);

            if (room != null)
            {
                Console.WriteLine($"[Disconnect] Broadcasting UserDisconnected to room {roomId}");
                await Clients.Group(roomId).SendAsync("UserDisconnected", new
                {
                    username = user.Username,
                    userCount = room.Users.Count
                });
            }

            // Remove the ?. operators since user is guaranteed non-null here
            Console.WriteLine($"[Disconnect] User: {user.Username}, RoomId: {user.RoomId}");

            // Inside ContinueWith, capture user in a local variable to satisfy the compiler
            _ = Task.Delay(ReconnectGracePeriod, cts.Token).ContinueWith(async t =>
            {
                if (t.IsCanceled) return;

                lock (_lock)
                {
                    _disconnectedUsers.Remove(sessionToken);
                    _disconnectTimers.Remove(sessionToken);
                }

                var latestRoom = _roomService.GetRoom(roomId);
                var capturedUser = user;
                if (capturedUser != null) _roomService.RemoveUser(capturedUser);

                await Groups.RemoveFromGroupAsync(Context.ConnectionId, roomId);

                if (latestRoom != null)
                {
                    await Clients.Group(roomId).SendAsync("UserLeft", new
                    {
                        username = user.Username,
                        userCount = latestRoom.Users.Count
                    });
                }
            });
        }

        await base.OnDisconnectedAsync(exception);
    }

    public async Task SendMessage(string content)
    {
        User? user;
        lock (_lock)
        {
            _connectedUsers.TryGetValue(Context.ConnectionId, out user);
        }

        if (user == null) return;

        var message = new Message
        {
            Username = user.Username,
            Content = content,
            Type = MessageType.Text
        };

        await Clients.Group(user.RoomId).SendAsync("ReceiveMessage", new
        {
            username = message.Username,
            content = message.Content,
            timestamp = message.Timestamp,
            type = "text"
        });
    }

    public async Task SendArt(string artData)
    {
        User? user;
        lock (_lock)
        {
            _connectedUsers.TryGetValue(Context.ConnectionId, out user);
        }

        if (user == null) return;

        var message = new Message
        {
            Username = user.Username,
            Content = artData,
            Type = MessageType.Art
        };

        await Clients.Group(user.RoomId).SendAsync("ReceiveMessage", new
        {
            username = message.Username,
            content = message.Content,
            timestamp = message.Timestamp,
            type = "art"
        });
    }

}