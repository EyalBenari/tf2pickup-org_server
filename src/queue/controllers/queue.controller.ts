import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Post,
  Put,
  UseFilters,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { QueueService } from '../services/queue.service';
import { MapVoteService } from '../services/map-vote.service';
import { QueueAnnouncementsService } from '../services/queue-announcements.service';
import { FriendsService } from '../services/friends.service';
import { MapPoolService } from '../services/map-pool.service';
import { Auth } from '@/auth/decorators/auth.decorator';
import { MapPoolEntry } from '../models/map-pool-entry';
import { PlayerRole } from '@/players/models/player-role';
import { Serializable } from '@/shared/serializable';
import { QueueSlotDto } from '../dto/queue-slot.dto';
import { QueueSlotWrapper } from './queue-slot-wrapper';
import { QueueDto } from '../dto/queue.dto';
import { QueueWrapper } from './queue-wrapper';
import { MapPoolEntryDto } from '../dto/map-pool-item.dto';
import { User } from '@/auth/decorators/user.decorator';
import { Player } from '@/players/models/player';
import { QueueConfig } from '@/queue-config/interfaces/queue-config';
import { MongoDbErrorFilter } from '@/shared/filters/mongo-db-error.filter';

@Controller('queue')
export class QueueController {
  constructor(
    @Inject('QUEUE_CONFIG')
    private readonly queueConfig: QueueConfig,
    private queueService: QueueService,
    private mapVoteService: MapVoteService,
    private queueAnnouncementsService: QueueAnnouncementsService,
    private friendsService: FriendsService,
    private mapPoolService: MapPoolService,
  ) {}

  @Get()
  async getQueue(): Promise<Serializable<QueueDto>> {
    return new QueueWrapper({
      config: this.queueConfig,
      slots: this.queueService.slots,
      state: this.queueService.state,
      mapVoteResults: this.mapVoteService.results,
      substituteRequests:
        await this.queueAnnouncementsService.substituteRequests(),
      friendships: this.friendsService.friendships,
    });
  }

  @Get('config')
  getQueueConfig() {
    return this.queueConfig;
  }

  @Get('state')
  getQueueState() {
    return this.queueService.state;
  }

  @Get('slots')
  getQueueSlots(): Serializable<QueueSlotDto>[] {
    return this.queueService.slots.map((s) => new QueueSlotWrapper(s));
  }

  @Get('map_vote_results')
  getMapVoteResults() {
    return this.mapVoteService.results;
  }

  @Put('map_vote_results/scramble')
  @Auth(PlayerRole.admin)
  async scrambleMaps(@User() actor: Player) {
    return await this.mapVoteService.scramble(actor._id);
  }

  @Get('announcements')
  async getSubstituteRequests() {
    return await this.queueAnnouncementsService.substituteRequests();
  }

  @Get('friendships')
  getFriendships() {
    return this.friendsService.friendships;
  }

  @Get('maps')
  async getMaps(): Promise<Serializable<MapPoolEntryDto>[]> {
    return await this.mapPoolService.getMaps();
  }

  @Post('maps')
  @Auth(PlayerRole.admin)
  @UsePipes(ValidationPipe)
  @UseFilters(MongoDbErrorFilter)
  async addMap(
    @Body() map: MapPoolEntry,
  ): Promise<Serializable<MapPoolEntryDto>> {
    return await this.mapPoolService.addMap(map);
  }

  @Delete('maps/:name')
  @Auth(PlayerRole.admin)
  async deleteMap(
    @Param('name') name: string,
  ): Promise<Serializable<MapPoolEntryDto>> {
    return await this.mapPoolService.removeMap(name);
  }

  @Put('maps')
  @Auth(PlayerRole.admin)
  @UsePipes(ValidationPipe)
  async setMaps(
    @Body() maps: MapPoolEntry[],
  ): Promise<Serializable<MapPoolEntryDto>[]> {
    return await this.mapPoolService.setMaps(maps);
  }
}
