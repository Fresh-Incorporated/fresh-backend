import { Table, Column, Model, PrimaryKey, AutoIncrement, DataType, AllowNull, BelongsTo, ForeignKey } from 'sequelize-typescript';
import { User } from './User';

@Table({ tableName: 'balance_history', paranoid: true, timestamps: true })
export class BalanceHistory extends Model<BalanceHistory> {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.INTEGER)
  declare id: number;

  @AllowNull(false)
  @Column(DataType.DOUBLE)
  declare value: number;

  @AllowNull(true)
  @Column(DataType.TEXT)
  declare message: string | null;

  @AllowNull(true)
  @Column(DataType.ENUM('deposit', 'freshmarket_shop_withdraw', 'withdraw', 'freshmarket_order', 'freshmarket_pay', 'freshmarket_salary'))
  declare action_type: string | null;

  @ForeignKey(() => User)
  @AllowNull(false)
  @Column(DataType.INTEGER)
  declare userId: number;

  @BelongsTo(() => User, 'userId')
  declare user: User;
}
