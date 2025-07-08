import {
  Table, Column, Model, PrimaryKey, AutoIncrement, DataType, AllowNull, BelongsTo, ForeignKey
} from 'sequelize-typescript';
import { Shop } from './Shop';
import { User } from './User';

@Table({ tableName: 'shops_history', paranoid: true, timestamps: true })
export class ShopHistory extends Model<ShopHistory> {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.INTEGER)
  declare id: number;

  @AllowNull(false)
  @Column(DataType.ENUM('created', 'withdraw', 'recheck', 'edited', 'limit_increase'))
  declare action_type: string;

  @AllowNull(true)
  @Column(DataType.TEXT)
  declare message: string | null;

  @AllowNull(true)
  @Column(DataType.JSONB)
  declare data: object | null;

  @ForeignKey(() => Shop)
  @AllowNull(false)
  @Column(DataType.INTEGER)
  declare shopId: number;

  @BelongsTo(() => Shop, 'shopId')
  declare shop: Shop;

  @ForeignKey(() => User)
  @AllowNull(false)
  @Column(DataType.INTEGER)
  declare userId: number;

  @BelongsTo(() => User, 'userId')
  declare user: User;
} 