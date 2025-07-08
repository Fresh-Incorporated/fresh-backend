import {
  Table, Column, Model, PrimaryKey, AutoIncrement, DataType, AllowNull, BelongsTo, ForeignKey
} from 'sequelize-typescript';
import { User } from './User';
import { Order } from './Order';

@Table({ tableName: 'orders_history', paranoid: true, timestamps: true })
export class OrderHistory extends Model<OrderHistory> {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.INTEGER)
  declare id: number;

  @AllowNull(false)
  @Column(DataType.ENUM('created', 'paid', 'collect_picked', 'collect_finished', 'deliver_started', 'deliver_finished', 'confirmed'))
  declare action_type: string;

  @AllowNull(true)
  @Column(DataType.TEXT)
  declare message: string | null;

  @AllowNull(true)
  @Column(DataType.JSONB)
  declare data: object | null;

  @ForeignKey(() => User)
  @AllowNull(false)
  @Column(DataType.INTEGER)
  declare userId: number;

  @BelongsTo(() => User, 'userId')
  declare user: User;

  @ForeignKey(() => Order)
  @AllowNull(false)
  @Column(DataType.BIGINT)
  declare orderId: number;

  @BelongsTo(() => Order, 'orderId')
  declare order: Order;
} 