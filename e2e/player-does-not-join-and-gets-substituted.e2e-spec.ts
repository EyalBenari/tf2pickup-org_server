import { AppModule } from '@/app.module';
import { JwtTokenPurpose } from '@/auth/jwt-token-purpose';
import { AuthService } from '@/auth/services/auth.service';
import { ConfigurationService } from '@/configuration/services/configuration.service';
import { configureApplication } from '@/configure-application';
import { Events } from '@/events/events';
import { GameId } from '@/games/game-id';
import { GamesService } from '@/games/services/games.service';
import { PlayersService } from '@/players/services/players.service';
import { Tf2ClassName } from '@/shared/models/tf2-class-name';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { io, Socket } from 'socket.io-client';
import { players } from './test-data';
import { waitABit } from './utils/wait-a-bit';
import { waitForTheGameToLaunch } from './utils/wait-for-the-game-to-launch';

describe('Player does not join the gameserver and gets substituted (e2e)', () => {
  let app: INestApplication;
  let playersService: PlayersService;
  let gameId: GameId;
  let events: Events;
  let leaverPlayerSocket: Socket;
  let leaverBans: any[];
  let replacementPlayerSocket: Socket;
  let substituteRequests: any[];

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureApplication(app);
    await app.listen(3000);

    playersService = app.get(PlayersService);
    events = app.get(Events);

    const authService = app.get(AuthService);

    const leaverPlayerToken = await authService.generateJwtToken(
      JwtTokenPurpose.websocket,
      (
        await playersService.findBySteamId(players[1])
      ).id,
    );

    leaverPlayerSocket = io(
      `http://localhost:${app.getHttpServer().address().port}`,
      {
        auth: { token: `Bearer ${leaverPlayerToken}` },
      },
    );

    const replacementPlayerToken = await authService.generateJwtToken(
      JwtTokenPurpose.websocket,
      (
        await playersService.findBySteamId(players[12])
      ).id,
    );

    replacementPlayerSocket = io(
      `http://localhost:${app.getHttpServer().address().port}`,
      {
        auth: { token: `Bearer ${replacementPlayerToken}` },
      },
    );

    substituteRequests = [];
    leaverBans = [];
    leaverPlayerSocket.on(
      'substitute requests update',
      (requests) => (substituteRequests = requests),
    );
    leaverPlayerSocket.on(
      'profile update',
      (profile) => (leaverBans = profile.bans ?? []),
    );
  });

  beforeAll(async () => {
    const configurationService = app.get(ConfigurationService);
    await configurationService.set(
      'games.join_gameserver_timeout',
      60 * 1000, // 1 minute
    );
    await configurationService.set(
      'games.rejoin_gameserver_timeout',
      30 * 1000,
    );
  });

  beforeAll(async () => {
    const gamesService = app.get(GamesService);
    const game = await gamesService.create(
      [
        {
          id: 0,
          gameClass: Tf2ClassName.scout,
          playerId: (await playersService.findBySteamId(players[0]))._id,
          ready: true,
        },
        {
          id: 1,
          gameClass: Tf2ClassName.scout,
          playerId: (await playersService.findBySteamId(players[1]))._id,
          ready: true,
        },
        {
          id: 2,
          gameClass: Tf2ClassName.scout,
          playerId: (await playersService.findBySteamId(players[2]))._id,
          ready: true,
        },
        {
          id: 3,
          gameClass: Tf2ClassName.scout,
          playerId: (await playersService.findBySteamId(players[3]))._id,
          ready: true,
        },
        {
          id: 4,
          gameClass: Tf2ClassName.soldier,
          playerId: (await playersService.findBySteamId(players[4]))._id,
          ready: true,
        },
        {
          id: 5,
          gameClass: Tf2ClassName.soldier,
          playerId: (await playersService.findBySteamId(players[5]))._id,
          ready: true,
        },
        {
          id: 6,
          gameClass: Tf2ClassName.soldier,
          playerId: (await playersService.findBySteamId(players[6]))._id,
          ready: true,
        },
        {
          id: 7,
          gameClass: Tf2ClassName.soldier,
          playerId: (await playersService.findBySteamId(players[7]))._id,
          ready: true,
        },
        {
          id: 8,
          gameClass: Tf2ClassName.demoman,
          playerId: (await playersService.findBySteamId(players[8]))._id,
          ready: true,
        },
        {
          id: 9,
          gameClass: Tf2ClassName.demoman,
          playerId: (await playersService.findBySteamId(players[9]))._id,
          ready: true,
        },
        {
          id: 10,
          gameClass: Tf2ClassName.medic,
          playerId: (await playersService.findBySteamId(players[10]))._id,
          ready: true,
          canMakeFriendsWith: [
            Tf2ClassName.scout,
            Tf2ClassName.soldier,
            Tf2ClassName.demoman,
          ],
        },
        {
          id: 11,
          gameClass: Tf2ClassName.medic,
          playerId: (await playersService.findBySteamId(players[11]))._id,
          ready: true,
          canMakeFriendsWith: [
            Tf2ClassName.scout,
            Tf2ClassName.soldier,
            Tf2ClassName.demoman,
          ],
        },
      ],
      'cp_badlands',
    );
    gameId = game._id;
    await waitABit(1000);
    await waitForTheGameToLaunch(app, gameId.toString());

    const player = await playersService.findBySteamId(players[1]);

    for (const slot of game.slots.filter((s) => !s.player.equals(player._id))) {
      const player = await playersService.getById(slot.player);
      events.playerJoinedGameServer.next({
        gameId,
        steamId: player.steamId,
        ipAddress: '127.0.0.1',
      });
      await waitABit(100);
      events.playerJoinedTeam.next({
        gameId,
        steamId: player.steamId,
      });
      await waitABit(100);
    }
  });

  afterAll(async () => {
    await waitABit(1000);

    const gamesService = app.get(GamesService);
    await gamesService.forceEnd(gameId);

    await waitABit(1000);
    await app.close();
  });

  it("should substitute a player that doesn't join the gameserver on time", async () => {
    const leaver = await playersService.findBySteamId(players[1]);
    expect(substituteRequests.length).toEqual(0);
    await waitABit(70 * 1000);
    expect(substituteRequests.length).toEqual(1);
    expect(substituteRequests[0]).toEqual({
      gameId: gameId.toString(),
      gameNumber: expect.any(Number),
      gameClass: Tf2ClassName.scout,
      team: expect.any(String),
    });
    // the player should not be given a cooldown for now
    expect(leaverBans.length).toBe(0);

    await waitABit(1000);

    // a replacement player takes the substitute spot
    replacementPlayerSocket.emit('replace player', {
      gameId: gameId.toString(),
      replaceeId: leaver.id,
    });

    await waitABit(1000);

    // the leaver should be given a cooldown
    expect(leaverBans.length).toBe(1);
    expect(leaverBans[0].reason).toEqual('Cooldown level 0');
  });
});
