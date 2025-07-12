import {
  Table, Column, Model, PrimaryKey, AutoIncrement, DataType, Default, AllowNull, Unique, BelongsTo, ForeignKey, HasMany
} from 'sequelize-typescript';
import { v4 as uuidv4 } from 'uuid';
import { User } from './User';
import { Product } from './Product';
import { ShopHistory } from './ShopHistory';
import { ShopCoOwner } from './ShopCoOwner';

@Table({ tableName: 'shops', paranoid: true, timestamps: true })
export class Shop extends Model<Shop> {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.INTEGER)
  declare id: number;

  @AllowNull(false)
  @Column(DataType.STRING)
  declare name: string;

  @AllowNull(false)
  @Column(DataType.TEXT)
  declare description: string;

  @AllowNull(true)
  @Column(DataType.TEXT)
  declare icon: string | null;

  @Default(3)
  @AllowNull(false)
  @Column(DataType.SMALLINT)
  declare products_limit: number;

  @Default(0)
  @AllowNull(false)
  @Column(DataType.SMALLINT)
  declare verify_status: number;

  @Default(0)
  @AllowNull(false)
  @Column(DataType.DOUBLE)
  declare balance: number;

  @Unique
  @AllowNull(false)
  @Default(() => uuidv4().replace(/-/g, ''))
  @Column(DataType.STRING)
  declare tag: string;

  @Default(true)
  @AllowNull(false)
  @Column(DataType.BOOLEAN)
  declare enabled: boolean;

  // ForeignKey и связь с User (owner)
  @ForeignKey(() => User)
  @AllowNull(false)
  @Column(DataType.INTEGER)
  declare ownerId: number;

  @BelongsTo(() => User, 'ownerId')
  declare owner: User;

  @HasMany(() => Product, 'shopId')
  declare products: Product[];

  @HasMany(() => ShopHistory, 'shopId')
  declare history: ShopHistory[];

  @HasMany(() => ShopCoOwner, 'shopId')
  declare co_owners: ShopCoOwner[];
}
