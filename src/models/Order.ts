import {
  Table, Column, Model, PrimaryKey, AutoIncrement, DataType, Default, AllowNull, BelongsTo, ForeignKey, HasMany
} from 'sequelize-typescript';
import { User } from './User';
import { Location } from './Location';
import { LocationCell } from './LocationCell';
import { OrderHistory } from './OrderHistory';

@Table({ tableName: 'orders', paranoid: true, timestamps: true })
export class Order extends Model<Order> {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.BIGINT)
  declare id: number;

  @AllowNull(false)
  @Column(DataType.STRING)
  declare type: string;

  @AllowNull(true)
  @Column(DataType.STRING)
  declare world: string | null;

  @AllowNull(true)
  @Column(DataType.INTEGER)
  declare x: number | null;

  @AllowNull(true)
  @Column(DataType.INTEGER)
  declare y: number | null;

  @AllowNull(true)
  @Column(DataType.INTEGER)
  declare z: number | null;

  @AllowNull(false)
  @Column(DataType.JSONB)
  declare data: object;

  @AllowNull(false)
  @Column(DataType.DOUBLE)
  declare price: number;

  @Default(0)
  @AllowNull(false)
  @Column(DataType.INTEGER)
  declare status: number;

  @Default(false)
  @AllowNull(false)
  @Column(DataType.BOOLEAN)
  declare paid: boolean;

  @ForeignKey(() => User)
  @AllowNull(false)
  @Column(DataType.INTEGER)
  declare customerId: number;

  @BelongsTo(() => User, 'customerId')
  declare customer: User;

  @ForeignKey(() => User)
  @AllowNull(true)
  @Column(DataType.INTEGER)
  declare currentWorkerId: number;

  @BelongsTo(() => User, 'currentWorkerId')
  declare currentWorker: User;

  @ForeignKey(() => Location)
  @AllowNull(false)
  @Column(DataType.INTEGER)
  declare branchId: number;

  @BelongsTo(() => Location, 'branchId')
  declare branch: Location;

  @ForeignKey(() => LocationCell)
  @AllowNull(true)
  @Column(DataType.INTEGER)
  declare branchCellId: number;

  @BelongsTo(() => LocationCell, 'branchCellId')
  declare branchCell: LocationCell;

  @ForeignKey(() => LocationCell)
  @AllowNull(true)
  @Column(DataType.INTEGER)
  declare deliverCellId: number;

  @BelongsTo(() => LocationCell, 'deliverCellId')
  declare deliverCell: LocationCell;

  @HasMany(() => OrderHistory, 'orderId')
  declare history: OrderHistory[];
} 