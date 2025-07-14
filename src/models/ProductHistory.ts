import { Table, Column, Model, PrimaryKey, AutoIncrement, DataType, AllowNull, BelongsTo, ForeignKey } from 'sequelize-typescript';
import { User } from './User';
import { Product } from './Product';

@Table({ tableName: 'products_history', paranoid: true, timestamps: true })
export class ProductHistory extends Model<ProductHistory> {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.INTEGER)
  declare id: number;

  @AllowNull(false)
  @Column(DataType.ENUM('created', 'accepted', 'declined', 'refill_started', 'refill_waiting', 'refill_picked', 'refill_completed', 'recheck', 'edited'))
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

  @ForeignKey(() => Product)
  @AllowNull(false)
  @Column(DataType.INTEGER)
  declare productId: number;

  @BelongsTo(() => Product, 'productId')
  declare product: Product;
}
