import {
  Table, Column, Model, PrimaryKey, AutoIncrement, DataType, HasMany, Default
} from 'sequelize-typescript';
import { Shop } from './Shop';
import { BalanceHistory } from './BalanceHistory';
import { UserWebpush } from './UserWebpush';
import { ShopCoOwner } from './ShopCoOwner';

@Table({ tableName: 'users', timestamps: true })
export class User extends Model<User> {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.INTEGER)
  declare id: number;

  @Column(DataType.STRING)
  declare nickname: string;

  @Column(DataType.UUID)
  declare uuid: string;

  @Column(DataType.BIGINT)
  declare discordId: string | null;

  @Default(0)
  @Column(DataType.DOUBLE)
  declare balance: number;

  @Default(0)
  @Column(DataType.DOUBLE)
  declare bonuses: number;

  @Default(0)
  @Column(DataType.SMALLINT)
  declare fm_worker: number;

  @Default(false)
  @Column(DataType.BOOLEAN)
  declare admin: boolean;

  @HasMany(() => Shop, 'ownerId')
  declare shops: Shop[];

  @HasMany(() => BalanceHistory, 'userId')
  declare balanceHistory: BalanceHistory[];

  @HasMany(() => UserWebpush, 'userId')
  declare webpushs: UserWebpush[];

  @HasMany(() => ShopCoOwner, 'userId')
  declare co_owns: ShopCoOwner[];
}
