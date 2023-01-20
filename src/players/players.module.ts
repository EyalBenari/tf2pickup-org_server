import { Module, forwardRef } from '@nestjs/common';
import { PlayersService } from './services/players.service';
import { Etf2lProfileService } from './services/etf2l-profile.service';
import { Player, playerSchema } from './models/player';
import { PlayerBansService } from './services/player-bans.service';
import { PlayerBan, playerBanSchema } from './models/player-ban';
import { PlayersController } from './controllers/players.controller';
import { GamesModule } from '@/games/games.module';
import { OnlinePlayersService } from './services/online-players.service';
import { PlayersGateway } from './gateways/players.gateway';
import { HallOfFameController } from './controllers/hall-of-fame.controller';
import { SteamApiService } from './services/steam-api.service';
import { QueueModule } from '@/queue/queue.module';
import { FuturePlayerSkillService } from './services/future-player-skill.service';
import {
  FuturePlayerSkill,
  futurePlayerSkillSchema,
} from './models/future-player-skill';
import { ConfigurationModule } from '@/configuration/configuration.module';
import { LinkedProfilesService } from './services/linked-profiles.service';
import { MongooseModule } from '@nestjs/mongoose';
import { OnlinePlayersController } from './controllers/online-players.controller';
import { ImportExportSkillService } from './services/import-export-skill.service';
import { QueueConfigModule } from '@/queue-config/queue-config.module';
import { HttpModule } from '@/http.module';
import { PlayersConfigurationService } from './services/players-configuration.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Player.name, schema: playerSchema },
      { name: PlayerBan.name, schema: playerBanSchema },
      { name: FuturePlayerSkill.name, schema: futurePlayerSkillSchema },
    ]),

    HttpModule,
    forwardRef(() => GamesModule),
    forwardRef(() => QueueModule),
    ConfigurationModule,
    QueueConfigModule,
  ],
  providers: [
    PlayersService,
    Etf2lProfileService,
    PlayerBansService,
    OnlinePlayersService,
    PlayersGateway,
    SteamApiService,
    FuturePlayerSkillService,
    LinkedProfilesService,
    ImportExportSkillService,
    PlayersConfigurationService,
  ],
  exports: [
    PlayersService,
    PlayerBansService,
    OnlinePlayersService,
    LinkedProfilesService,
  ],
  controllers: [
    PlayersController,
    HallOfFameController,
    OnlinePlayersController,
  ],
})
export class PlayersModule {}
