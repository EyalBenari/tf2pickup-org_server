import { CertificatesService } from '@/certificates/services/certificates.service';
import { ConfigurationService } from '@/configuration/services/configuration.service';
import { Environment } from '@/environment/environment';
import { Events } from '@/events/events';
import { Game, gameSchema } from '@/games/models/game';
import { GameRuntimeService } from '@/game-coordinator/services/game-runtime.service';
import { GamesService } from '@/games/services/games.service';
import { mongooseTestingModule } from '@/utils/testing-mongoose-module';
import { getConnectionToken, MongooseModule } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Connection } from 'mongoose';
import { MumbleBotService } from './mumble-bot.service';
import { MumbleBot } from './mumble-bot';
import { GameState } from '@/games/models/game-state';
import { VoiceServerType } from '@/games/voice-server-type';

jest.mock('@/environment/environment');
jest.mock('@/configuration/services/configuration.service');
jest.mock('@/certificates/services/certificates.service');
jest.mock('@/games/services/games.service');
jest.mock('@/game-coordinator/services/game-runtime.service');
jest.mock('./mumble-bot');

describe('MumbleBotService', () => {
  let service: MumbleBotService;
  let mongod: MongoMemoryServer;
  let connection: Connection;
  let configurationService: jest.Mocked<ConfigurationService>;
  let certificatesService: jest.Mocked<CertificatesService>;
  let environment: jest.Mocked<Environment>;
  let events: Events;
  let gamesService: GamesService;

  beforeAll(async () => (mongod = await MongoMemoryServer.create()));
  afterAll(async () => await mongod.stop());

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        mongooseTestingModule(mongod),
        MongooseModule.forFeature([{ name: Game.name, schema: gameSchema }]),
      ],
      providers: [
        MumbleBotService,
        Environment,
        ConfigurationService,
        Events,
        CertificatesService,
        GamesService,
        GameRuntimeService,
      ],
    }).compile();

    service = module.get<MumbleBotService>(MumbleBotService);
    connection = module.get(getConnectionToken());
    configurationService = module.get(ConfigurationService);
    certificatesService = module.get(CertificatesService);
    environment = module.get(Environment);
    events = module.get(Events);
    gamesService = module.get(GamesService);
  });

  beforeEach(() => {
    configurationService.get.mockImplementation((key: string) =>
      Promise.resolve(
        {
          'games.voice_server_type': VoiceServerType.mumble,
          'games.voice_server.mumble.url': 'FAKE_MUMBLE_URL',
          'games.voice_server.mumble.port': 64738,
          'games.voice_server.mumble.channel_name': 'FAKE_CHANNEL_NAME',
        }[key],
      ),
    );
    certificatesService.getCertificate.mockResolvedValue({
      id: 'FAKE_ID',
      purpose: 'mumble',
      clientKey: 'FAKE_CLIENT_KEY',
      certificate: 'FAKE_CERTIFICATE',
    });
    Object.defineProperty(environment, 'botName', {
      get: jest.fn().mockReturnValue('FAKE_BOT_NAME'),
    });
  });

  beforeEach(async () => {
    await service.onModuleInit();
  });

  afterEach(() => {
    (MumbleBot as jest.MockedClass<typeof MumbleBot>).mockClear();
  });

  afterEach(async () => {
    await connection.close();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('when connected', () => {
    let mockMumbleBot: MumbleBot;

    beforeEach(async () => {
      await service.tryConnect();
      const mockInstances = (MumbleBot as jest.MockedClass<typeof MumbleBot>)
        .mock.instances;
      mockMumbleBot = mockInstances[mockInstances.length - 1];
    });

    it('should create new mumble bot and connect', () => {
      expect(
        MumbleBot as jest.MockedClass<typeof MumbleBot>,
      ).toHaveBeenCalledWith({
        host: 'FAKE_MUMBLE_URL',
        port: 64738,
        username: 'FAKE_BOT_NAME',
        clientName: expect.any(String),
        password: undefined,
        certificate: {
          id: 'FAKE_ID',
          purpose: 'mumble',
          clientKey: 'FAKE_CLIENT_KEY',
          certificate: 'FAKE_CERTIFICATE',
        },
        targetChannelName: 'FAKE_CHANNEL_NAME',
      });
      expect(mockMumbleBot.connect).toHaveBeenCalledTimes(1);
    });

    describe('#createChannels()', () => {
      it('should create channels', async () => {
        const game = new Game();
        await service.createChannels(game);
        expect(mockMumbleBot.setupChannels).toHaveBeenCalledWith(game);
      });

      it('should be called upon game creation', () => {
        const game = new Game();
        events.gameCreated.next({ game });
        expect(mockMumbleBot.setupChannels).toHaveBeenCalledWith(game);
      });
    });

    describe('#linkChannels()', () => {
      it('should link channels', async () => {
        const game = new Game();
        await service.linkChannels(game);
        expect(mockMumbleBot.linkChannels).toHaveBeenCalledWith(game);
      });

      it('should be called when a game ends', () => {
        const oldGame = new Game();
        oldGame.state = GameState.started;
        const newGame = new Game();
        newGame.state = GameState.ended;
        events.gameChanges.next({ oldGame, newGame });
        expect(mockMumbleBot.linkChannels).toHaveBeenCalledWith(newGame);
      });
    });

    describe('#removeOldChannels()', () => {
      it('should remove old channels', async () => {
        await service.removeOldChannels();
        expect(mockMumbleBot.removeObsoleteChannels).toHaveBeenCalled();
      });
    });
  });
});
