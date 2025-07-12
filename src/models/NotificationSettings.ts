import {
  Table, Column, Model, PrimaryKey, AutoIncrement, DataType, Default, AllowNull, BelongsTo, ForeignKey
} from 'sequelize-typescript';
import { User } from './User';

@Table({ tableName: 'notification_settings', paranoid: true, timestamps: true })
export class NotificationSettings extends Model<NotificationSettings> {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.INTEGER)
  declare id: number;

  @AllowNull(false)
  @Column(DataType.ENUM('webpush', 'discord'))
  declare target: string;

  @AllowNull(false)
  @Default(false)
  @Column(DataType.BOOLEAN)
  declare priority: boolean;

  @AllowNull(false)
  @Default(false)
  @Column(DataType.BOOLEAN)
  declare market_shop: boolean;

  @AllowNull(false)
  @Default(false)
  @Column(DataType.BOOLEAN)
  declare market_delivered: boolean;

  @AllowNull(false)
  @Default(false)
  @Column(DataType.BOOLEAN)
  declare market_work: boolean;

  @ForeignKey(() => User)
  @AllowNull(false)
  @Column(DataType.INTEGER)
  declare userId: number;

  @BelongsTo(() => User, 'userId')
  declare user: User;
}
