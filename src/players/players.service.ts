import { Injectable } from '@nestjs/common';
import { ConfigService } from 'src/config/config.service';
import { Player } from './models/player';
import { DocumentType, ReturnModelType } from '@typegoose/typegoose';
import { SteamProfile } from './models/steam-profile';
import { Etf2lProfileService } from './etf2l-profile.service';
import { InjectModel } from 'nestjs-typegoose';

@Injectable()
export class PlayersService {

  constructor(
    private configService: ConfigService,
    private etf2lProfileService: Etf2lProfileService,
    @InjectModel(Player) private playerModel: ReturnModelType<typeof Player>,
  ) { }

  async findById(id: string): Promise<DocumentType<Player>> {
    return await this.playerModel.findById(id);
  }

  async findBySteamId(steamId: string): Promise<DocumentType<Player>> {
    return await this.playerModel.findOne({ steamId });
  }

  async createPlayer(steamProfile: SteamProfile): Promise<DocumentType<Player>> {
    const etf2lProfile = await this.etf2lProfileService.fetchPlayerInfo(steamProfile.id);
    if (etf2lProfile.bans && etf2lProfile.bans.filter(ban => ban.end > Date.now()).length > 0) {
      throw new Error('This account is banned on ETF2L.');
    }

    const player = await this.playerModel.create({
      steamId: steamProfile.id,
      name: etf2lProfile.name,
      avatarUrl: steamProfile.photos[0].value,
      role: null,
      etf2lProfileId: etf2lProfile.id,
    });

    return player;
  }

}
