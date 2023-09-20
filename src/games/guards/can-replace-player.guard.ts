import { ConfigurationService } from '@/configuration/services/configuration.service';
import { PlayerBansService } from '@/players/services/player-bans.service';
import { PlayersService } from '@/players/services/players.service';
import {
  DenyReason,
  PlayerDeniedError,
} from '@/shared/errors/player-denied.error';
import { Tf2ClassName } from '@/shared/models/tf2-class-name';
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import { Socket } from 'socket.io';
import { GamesService } from '../services/games.service';
import { Types } from 'mongoose';
import { GameId } from '../game-id';
import { SlotStatus } from '../models/slot-status';

@Injectable()
export class CanReplacePlayerGuard implements CanActivate {
  constructor(
    private readonly playersService: PlayersService,
    private readonly configurationService: ConfigurationService,
    private readonly playerBansService: PlayerBansService,
    private readonly gamesService: GamesService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const socket = context.switchToWs().getClient<Socket>();
    if (!socket.user) {
      throw new WsException('not logged in');
    }

    const player = await this.playersService.getById(socket.user._id);
    if (!player.hasAcceptedRules) {
      throw new PlayerDeniedError(player, DenyReason.playerHasNotAcceptedRules);
    }

    if (player.skill) {
      const data = context.switchToWs().getData() as {
        gameId: string;
        replaceeId: string;
      };

      const game = await this.gamesService.getById(
        new Types.ObjectId(data.gameId) as GameId,
      );
      const slot = game.slots.find(
        (slot) =>
          slot.status === SlotStatus.waitingForSubstitute &&
          slot.player.equals(data.replaceeId),
      );

      if (slot) {
        const minimumSkillThresholds = await this.configurationService.get<
          Partial<Record<Tf2ClassName, number>>
        >('queue.minimum_skill_thresholds');

        const minimumClassThreshold = minimumSkillThresholds[slot.gameClass];
        if (
          (player.skill?.get(slot.gameClass) || 0) <
          (minimumClassThreshold || 0)
        ) {
          throw new PlayerDeniedError(player, DenyReason.playerSkillTooLow);
        }
      }
    } else if (
      await this.configurationService.get<boolean>(
        'queue.deny_players_with_no_skill_assigned',
      )
    ) {
      throw new PlayerDeniedError(player, DenyReason.noSkillAssigned);
    }

    const bans = await this.playerBansService.getPlayerActiveBans(player._id);
    if (bans.length > 0) {
      throw new PlayerDeniedError(player, DenyReason.playerIsBanned);
    }

    return true;
  }
}
