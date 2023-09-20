import { ConfigurationService } from '@/configuration/services/configuration.service';
import { PlayerBansService } from '@/players/services/player-bans.service';
import { PlayersService } from '@/players/services/players.service';
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import { Socket } from 'socket.io';
import {
  DenyReason,
  PlayerDeniedError,
} from '../../shared/errors/player-denied.error';
import { Tf2ClassName } from '@/shared/models/tf2-class-name';
import { QueueService } from '../services/queue.service';

@Injectable()
export class CanJoinQueueGuard implements CanActivate {
  constructor(
    private readonly configurationService: ConfigurationService,
    private readonly playerBansService: PlayerBansService,
    private readonly playersService: PlayersService,
    private readonly queueService: QueueService,
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
        slotId: number;
      };

      const slot = this.queueService.getSlotById(data.slotId);

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

    if (player.activeGame) {
      throw new PlayerDeniedError(player, DenyReason.playerIsInvolvedInGame);
    }

    return true;
  }
}
